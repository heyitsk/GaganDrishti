import Scan from '../models/Scan.js';
import Finding from '../models/Finding.js';

// ─── GET /scans — List user's scans with pagination ──────────────────────────
export const getScans = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const [scans, total] = await Promise.all([
      Scan.find({ userId: req.user._id })
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Scan.countDocuments({ userId: req.user._id }),
    ]);

    return res.status(200).json({
      scans,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get scans error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch scans' });
  }
};

// ─── GET /scans/:id — Get a specific scan ────────────────────────────────────
export const getScanDetails = async (req, res) => {
  try {
    const scan = await Scan.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).lean();

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    return res.status(200).json({ scan });
  } catch (error) {
    console.error('Get scan details error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch scan details' });
  }
};

// ─── GET /scans/:id/findings — Get findings for a specific scan ──────────────
export const getScanFindings = async (req, res) => {
  try {
    // Verify the scan belongs to this user
    const scan = await Scan.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).lean();

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    const findings = await Finding.find({ scanId: scan._id })
      .sort({ severity: 1, detectedAt: -1 })
      .lean();

    return res.status(200).json({ scan, findings });
  } catch (error) {
    console.error('Get scan findings error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch scan findings' });
  }
};

// ─── GET /findings — Get all findings with filters ───────────────────────────
/**
 * Query params:
 *   ?severity=CRITICAL         — filter by severity
 *   ?service=S3                — filter by service
 *   ?status=open               — filter by status (open, resolved, ignored)
 *   ?sortBy=detectedAt         — sort field (default: detectedAt)
 *   ?sortOrder=desc            — sort order (asc|desc, default: desc)
 *   ?page=1&limit=20           — pagination
 */
export const getFindings = async (req, res) => {
  try {
    const { severity, service, status, sortBy, sortOrder } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { userId: req.user._id };

    if (req.query.scanId) {
      filter.scanId = req.query.scanId;
    }

    if (severity) {
      const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      const upper = severity.toUpperCase();
      if (validSeverities.includes(upper)) {
        filter.severity = upper;
      }
    }

    if (service) {
      // Case-insensitive match via regex
      filter.service = { $regex: new RegExp(`^${service}$`, 'i') };
    }

    if (status) {
      const validStatuses = ['open', 'resolved', 'ignored'];
      if (validStatuses.includes(status.toLowerCase())) {
        filter.status = status.toLowerCase();
      }
    }

    // Build sort
    const allowedSortFields = ['detectedAt', 'severity', 'service', 'status'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'detectedAt';
    const order = sortOrder === 'asc' ? 1 : -1;

    const [findings, total] = await Promise.all([
      Finding.find(filter)
        .sort({ [sortField]: order })
        .skip(skip)
        .limit(limit)
        .lean(),
      Finding.countDocuments(filter),
    ]);

    return res.status(200).json({
      findings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get findings error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch findings' });
  }
};

// ─── GET /findings/timeline — Track findings detected over time ───────────────
/**
 * Query params:
 *   ?granularity=day          — bucketing unit: day | week | month (default: day)
 *   ?startDate=2026-03-01     — ISO date (default: 30 days ago)
 *   ?endDate=2026-04-01       — ISO date (default: today)
 *   ?service=S3               — filter by service (case-insensitive)
 *   ?severity=CRITICAL        — filter by severity
 */
export const getTimeline = async (req, res) => {
  try {
    const { granularity = 'day', service, severity } = req.query;

    // ── Date window ────────────────────────────────────────────────────────────
    const endDate = req.query.endDate
      ? new Date(req.query.endDate)
      : new Date();
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Validate parsed dates
    if (isNaN(startDate) || isNaN(endDate)) {
      return res.status(400).json({ error: 'Invalid startDate or endDate' });
    }

    // ── Granularity → $dateToString format ────────────────────────────────────
    const formatMap = { day: '%Y-%m-%d', week: '%Y-%U', month: '%Y-%m' };
    const dateFormat = formatMap[granularity] ?? '%Y-%m-%d';

    // ── Match filter ──────────────────────────────────────────────────────────
    const match = {
      userId: req.user._id,
      detectedAt: { $gte: startDate, $lte: endDate },
    };

    if (service) {
      match.service = { $regex: new RegExp(`^${service}$`, 'i') };
    }

    if (severity) {
      const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      const upper = severity.toUpperCase();
      if (validSeverities.includes(upper)) {
        match.severity = upper;
      }
    }

    // ── Aggregation ───────────────────────────────────────────────────────────
    const buckets = await Finding.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$detectedAt' } },
          new: { $sum: 1 },
          CRITICAL: { $sum: { $cond: [{ $eq: ['$severity', 'CRITICAL'] }, 1, 0] } },
          HIGH:     { $sum: { $cond: [{ $eq: ['$severity', 'HIGH']     }, 1, 0] } },
          MEDIUM:   { $sum: { $cond: [{ $eq: ['$severity', 'MEDIUM']   }, 1, 0] } },
          LOW:      { $sum: { $cond: [{ $eq: ['$severity', 'LOW']      }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // ── Shape response ────────────────────────────────────────────────────────
    const timeline = buckets.map((b) => ({
      date: b._id,
      new: b.new,
      bySeverity: {
        CRITICAL: b.CRITICAL,
        HIGH:     b.HIGH,
        MEDIUM:   b.MEDIUM,
        LOW:      b.LOW,
      },
    }));

    const totalInWindow = timeline.reduce((sum, b) => sum + b.new, 0);

    // ── Trend ─────────────────────────────────────────────────────────────────
    let trend = 'stable';
    if (timeline.length >= 2) {
      const mid = Math.floor(timeline.length / 2);
      const avg = (arr) => arr.reduce((s, b) => s + b.new, 0) / arr.length;
      const firstAvg  = avg(timeline.slice(0, mid));
      const secondAvg = avg(timeline.slice(mid));
      if (secondAvg > firstAvg) trend = 'increasing';
      else if (secondAvg < firstAvg) trend = 'decreasing';
    }

    return res.status(200).json({ timeline, trend, totalInWindow });
  } catch (error) {
    console.error('Timeline error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch timeline' });
  }
};

// ─── GET /dashboard/stats — Summary statistics ───────────────────────────────
export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Run all aggregations in parallel
    const [
      totalScans,
      recentScans,
      findingsBySeverity,
      findingsByService,
      findingsByStatus,
      totalFindings,
    ] = await Promise.all([
      // Total scan count
      Scan.countDocuments({ userId }),

      // Last 5 scans
      Scan.find({ userId })
        .sort({ startedAt: -1 })
        .limit(5)
        .lean(),

      // Findings grouped by severity
      Finding.aggregate([
        { $match: { userId } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),

      // Findings grouped by service
      Finding.aggregate([
        { $match: { userId } },
        { $group: { _id: '$service', count: { $sum: 1 } } },
      ]),

      // Findings grouped by status
      Finding.aggregate([
        { $match: { userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Total finding count
      Finding.countDocuments({ userId }),
    ]);

    // Transform aggregation results into cleaner objects
    const severityCounts = {};
    for (const item of findingsBySeverity) {
      severityCounts[item._id] = item.count;
    }

    const serviceCounts = {};
    for (const item of findingsByService) {
      serviceCounts[item._id] = item.count;
    }

    const statusCounts = {};
    for (const item of findingsByStatus) {
      statusCounts[item._id] = item.count;
    }

    return res.status(200).json({
      totalScans,
      totalFindings,
      severityCounts: {
        critical: severityCounts.CRITICAL || 0,
        high: severityCounts.HIGH || 0,
        medium: severityCounts.MEDIUM || 0,
        low: severityCounts.LOW || 0,
      },
      serviceCounts,
      statusCounts: {
        open: statusCounts.open || 0,
        resolved: statusCounts.resolved || 0,
        ignored: statusCounts.ignored || 0,
      },
      recentScans,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch dashboard stats' });
  }
};

// ─── PATCH /findings/:id/resolve — Mark a finding as resolved ────────────────
export const resolveFinding = async (req, res) => {
  try {
    const findingId = req.params.id;
    
    const finding = await Finding.findOne({ 
      _id: findingId, 
      userId: req.user._id 
    });

    if (!finding) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    await finding.resolve();

    return res.status(200).json({ message: 'Finding resolved successfully', finding });
  } catch (error) {
    console.error('Resolve finding error:', error);
    return res.status(500).json({ error: 'Failed to resolve finding' });
  }
};

// ─── PATCH /findings/:id/ignore — Mark a finding as ignored ────────────────
export const ignoreFinding = async (req, res) => {
  try {
    const findingId = req.params.id;
    
    const finding = await Finding.findOne({ 
      _id: findingId, 
      userId: req.user._id 
    });

    if (!finding) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    await finding.ignore();

    return res.status(200).json({ message: 'Finding ignored successfully', finding });
  } catch (error) {
    console.error('Ignore finding error:', error);
    return res.status(500).json({ error: 'Failed to ignore finding' });
  }
};

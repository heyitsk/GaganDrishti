// require("dotenv").config();  
import mongoose from "mongoose";
// console.log(process.env.MONGODB_URI);

const connectCluster = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("connected succesffully");
  } catch (error) {
    console.error("connection error : ", error.message);
    throw error;
  }
};
export default connectCluster;
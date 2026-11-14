require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const userModel = require("../models/user.model");
const accountModel = require("../models/account.model");

const SYSTEM_USER_EMAIL = "system@ledger.internal";
const SYSTEM_USER_PASSWORD = "system@123";
const SYSTEM_USER_NAME = "System User";

async function seedSystemUser() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    let user = await userModel.findOne({ email: SYSTEM_USER_EMAIL });

    if (!user) {
        const hashedPassword = await bcrypt.hash(SYSTEM_USER_PASSWORD, 10);

        // Use insertOne via the underlying collection to bypass immutable + select:false restrictions
        const result = await userModel.collection.insertOne({
            email: SYSTEM_USER_EMAIL,
            name: SYSTEM_USER_NAME,
            password: hashedPassword,
            systemUser: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        user = await userModel.findById(result.insertedId);
        console.log("System user created successfully!");
        console.log("  Email:   ", SYSTEM_USER_EMAIL);
        console.log("  Password:", SYSTEM_USER_PASSWORD);
    } else {
        console.log("System user already exists:", SYSTEM_USER_EMAIL);
    }

    // Create a bank account for the system user if one doesn't exist
    const existingAccount = await accountModel.findOne({ user: user._id });
    if (!existingAccount) {
        const account = await accountModel.create({
            user: user._id,
            type: "SYSTEM",
            status: "ACTIVE",
            currency: "INR"
        });
        console.log("System user bank account created:", account._id.toString());
    } else {
        if (existingAccount.type !== "SYSTEM") {
            await accountModel.updateOne({ _id: existingAccount._id }, { type: "SYSTEM" });
        }
        console.log("System user bank account already exists:", existingAccount._id.toString());
    }

    await mongoose.disconnect();
}

seedSystemUser().catch(err => {
    console.error("Seed failed:", err);
    process.exit(1);
});

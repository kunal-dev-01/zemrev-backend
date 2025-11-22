import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import {
  IUser,
  IUserModel,
  UserRole,
  AuthProvider,
  GoogleProfile,
} from "./user.interface.js";

const userSchema = new Schema<IUser, IUserModel>(
  {
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    authProvider: {
      type: String,
      enum: Object.values(AuthProvider),
      default: AuthProvider.LOCAL,
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
      index: true,
    },
    password: {
      type: String,
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    phoneNumber: {
      type: String,
      trim: true,
      match: [/^[0-9]{10,15}$/, "Please provide a valid phone number"],
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
      zipCode: { type: String, trim: true },
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    
    // 💳 CREDITS SYSTEM (NO PLANS)
    credits: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    status: {
      type: String,
      enum: ["inactive", "active"],
      default: "inactive",
      index: true,
    },
    
    // 💰 STRIPE (ONE-TIME PAYMENTS ONLY)
    stripeCustomerId: {
      type: String,
      sparse: true,
    },
    
    // 🔐 AUTHENTICATION
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    passwordChangedAt: {
      type: Date,
      select: false,
    },
    
    // 🔒 TWO-FACTOR AUTH
    twoFactorSecret: {
      type: String,
      select: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorBackupCodes: {
      type: [String],
      select: false,
    },
    superKey: {
      type: String,
      select: false,
    },
    
    // 🚫 ACCOUNT STATUS
    isActive: {
      type: Boolean,
      default: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    blockedReason: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ email: 1, role: 1 });
userSchema.index({ status: 1, credits: 1 });
userSchema.index({ stripeCustomerId: 1 });

// Pre-save hooks (keep existing password hashing)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  if (this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();
  this.passwordChangedAt = new Date(Date.now() - 1000);
  next();
});

// Methods (keep existing)
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp: number): boolean {
  if (!this.passwordChangedAt) return false;
  const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return JWTTimestamp < changedTimestamp;
};

userSchema.statics.findOrCreateGoogleUser = async function (
  profile: GoogleProfile
): Promise<IUser> {
  try {
    let user = await this.findOne({ googleId: profile.googleId });

    if (user) {
      // Update profile if changed
      let hasChanges = false;
      if (user.email !== profile.email) {
        user.email = profile.email;
        hasChanges = true;
      }
      if (user.fullName !== profile.name) {
        user.fullName = profile.name;
        hasChanges = true;
      }
      if (hasChanges) {
        await user.save({ validateModifiedOnly: true });
      }
      return user;
    }

    // Check if email already exists (merge accounts)
    const existingEmailUser = await this.findOne({ email: profile.email });
    
    if (existingEmailUser) {
      existingEmailUser.googleId = profile.googleId;
      existingEmailUser.authProvider = AuthProvider.GOOGLE;
      existingEmailUser.isEmailVerified = true;
      await existingEmailUser.save({ validateModifiedOnly: true });
      return existingEmailUser;
    }

    // ⚠️ NEW USER: Start with 0 credits, inactive status
    const newUser = await this.create({
      googleId: profile.googleId,
      authProvider: AuthProvider.GOOGLE,
      email: profile.email,
      fullName: profile.name,
      isActive: true,
      isEmailVerified: true,
      credits: 0,
      status: "inactive",
    });

    return newUser;
  } catch (err) {
    console.error("❌ Error in findOrCreateGoogleUser:", err);
    throw err;
  }
};

export const User = mongoose.model<IUser, IUserModel>("User", userSchema);
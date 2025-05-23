import { asyncHandler } from "../utils/asyncHandler.js";
import { APIError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResopnes.js";

const generateAccessAndRefreshTocken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessTocken();
    const refreshToken = user.generateRefreshTocken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new APIError(
      500,
      "Something went wrong while generating refresh and acceaa token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  console.log("FILES RECEIVED:", req.files);
  console.log("BODY RECEIVED:", req.body);
  // get user details from frontend
  // validation for not empty
  // check if user already exist : by email or username
  // check for images, check for avatar
  // upload them to cloudinary, avatar
  // create user objects - create entry in db
  // remove password and reference token field from response
  // check for user creation
  // return res

  const { fullName, email, username, password } = req.body;
  // console.log("fullName: ", fullName);
  // console.log("email: ", email);
  // console.log("userName: ", username);
  // console.log("password: ", password);

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new APIError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new APIError(409, "Username or Email already exist");
  }

  // console.log(req.files);

  // Corrected file existence checks
  if (!req.files?.avatar || req.files.avatar.length === 0) {
    return res.status(400).json(new APIError(400, "Avatar file is required"));
  }

  const avatarLocalPath = req.files.avatar[0].path;

  let coverImageLocalPath = null;
  if (req.files?.coverImage && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  // Upload avatar with error handling
  let avatar;
  try {
    avatar = await uploadOnCloudinary(avatarLocalPath);
    console.log("Uploaded avatar:", avatar);
  } catch (error) {
    console.error("Cloudinary avatar upload error:", error);
    throw new APIError(500, "Failed to upload avatar image");
  }

  // Upload cover image if present
  let coverImage = null;
  if (coverImageLocalPath) {
    try {
      coverImage = await uploadOnCloudinary(coverImageLocalPath);
      console.log("Uploaded cover image:", coverImage);
    } catch (error) {
      console.error("Cloudinary cover image upload error:", error);
      // You can decide whether to throw or just continue without coverImage
      // throw new APIError(500, "Failed to upload cover image");
    }
  }

  if (!avatar || !avatar.url) {
    throw new APIError(400, "Avatar upload failed or file is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createduser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createduser) {
    throw new APIError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createduser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // data
  // check email or username is available
  // if found check password
  // access and refresh token
  // send in cookies that successfully send

  const { email, username, password } = req.body;

  if (!username || !email) {
    throw new APIError(400, "userName or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new APIError(404, "user not exist!");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new APIError(401, "Invalid user credentials!");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTocken(
    user._id
  );

  const loggedInUser = await User.findById(user._id);
  select("-password -refreshToken");

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "user logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookies("accessToken", options)
    .clearCookies("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logout successfully"));
});

export { registerUser, loginUser, logoutUser };

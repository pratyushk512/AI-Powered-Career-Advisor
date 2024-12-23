import {asyncHandler} from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens= async(userId)=>{
    const user= await User.findById(userId)
    const accessToken =user.generateAccessToken()
    const refreshToken=user.generateRefreshToken()

    user.refreshToken= refreshToken
    await user.save({validateBeforeSave: false})

    return {accessToken,refreshToken}
}

const registerUser= asyncHandler ( async (req,res)=>{
    const {name,email,password}=req.body
    
    if(!name || !email || !password)
    {
        throw new ApiError(400,"All fields are required")
    }
    
    const existingUser= await User.findOne({email})
    if(existingUser){
        throw new ApiError(409,"User with email or username already exists")
    }

    /*const avatarLocalFilePath=req.files?.avatar[0]?.path;
    let coverImageLocalFilePath;

    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalFilePath=req.files.coverImage[0].path
    }

    if(!avatarLocalFilePath){
        throw new ApiError(400,"Avatar is required")
    }
    console.log(req.files)
    const avatar= await uploadOnCloudinary(avatarLocalFilePath);
    const coverImage= await uploadOnCloudinary(coverImageLocalFilePath);
    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }
    */

    const user= await User.create({
        name,
        email,
        password
    })
    const createdUser= await User.findById(user._id).select("-password -refreshToken")

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registerd successfully")
    )
})

const loginUser = asyncHandler ( async(req,res)=>{
    const {email,password} = req.body 

    if(!email){
        throw new ApiError(400,"Email is required")
    }

    const user= await User.findOne({
        email
    })

    if(!user){
        throw new ApiError(404,"User does not exist")
    }

    const isPasswordValid= await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid Password")
    }

    const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id)

    const loggedInUser= await User.findById(user._id).select("-password -refreshToken")

    const options={
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,accessToken,refreshToken
            },
            "User logged In successfully"
        )
    )
})

const logoutUser= asyncHandler ( async (req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )

    const options={
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User Logged Out"))

})

const updateProfile= asyncHandler ( async (req,res)=>{
    const {education,experience,skills,projects,interests,jobPreferences}=req.body
    
    const user=req.user
    if(education){
        user.education=education
    }
    if(experience){
        user.experience=experience
    }
    if(skills){
        user.skills=skills
    }
    if(projects){
        user.projects=projects
    }
    if(interests){
        user.interests=interests
    }
    if(jobPreferences){
        user.jobPreferences=jobPreferences
    }

    await user.save();
    return res
    .status(200)
    .json(new ApiResponse(200,{user},"User Profile Updated Successfully"))
})




const refreshAccessToken= asyncHandler ( async (req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(400,"Unauthorised request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
        const user= await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(401,"Invalid refresh token")
        }
    
        if(user?.refreshToken !== incomingRefreshToken){
            throw new ApiError(400,"Refresh Token is expired or used")
        }
    
        const {accessToken,newRefreshToken} =await generateAccessAndRefreshTokens(user._id)
    
        const options={
            httpOnly:true,
            secure:true
        }
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken,refreshToken:newRefreshToken},
                "Access Token Refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(400,error?.message || "Something went wrong")
    }
})

const changeCurrentPassword= asyncHandler( async (req,res)=>{
    const {oldPassword,newPassword}= req.body;
    const user= await User.findById(req.user?.id)
    const isPasswordCorrect= await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"Incorrect Password")
    }

    user.password=newPassword
    await user.save({validateBeforeSave: false})
    
})
export {registerUser,
        loginUser ,
        logoutUser,
        updateProfile,
        refreshAccessToken       
}
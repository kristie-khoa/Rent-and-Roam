if (process.env.Node_ENV !== "production") {
  require("dotenv").config();
}

const { cloudinary } = require("../cloudinary");

const fs = require("fs");
const path = require("path");

function getImageFilePaths(folderPath) {
  try {
    const files = fs.readdirSync(folderPath);
    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return (
        ext === ".jpg" || ext === ".jpeg" || ext === ".png" || ext === ".gif"
      );
    });

    const imageFilePaths = imageFiles.map((file) =>
      path.join(folderPath, file)
    );
    return imageFilePaths;
  } catch (error) {
    console.error("Error reading files from folder:", error);
    throw error;
  }
}

async function uploadImageToCloudinary(imageUrl) {
  try {
    const uploadResponse = await cloudinary.uploader.upload(imageUrl, {
      folder: "RentRoam", // Optional: specify a folder
    });

    return {
      url: uploadResponse.secure_url,
      filename: uploadResponse.public_id,
    };
  } catch (error) {
    console.error(`Error uploading image ${imageUrl}:`, error);
    throw error;
  }
}

async function uploadImages(imageUrls) {
  const uploadPromises = imageUrls.map(uploadImageToCloudinary);

  try {
    const uploadResults = await Promise.all(uploadPromises);
    return uploadResults;
  } catch (error) {
    console.error("Error uploading images:", error);
    throw error;
  }
}

module.exports = { uploadImages, getImageFilePaths };

const mongoose = require("mongoose");
const Listing = require("../models/listing");
const seedListings = require("./seedData");
const { uploadImages, getImageFilePaths } = require("./uploadSeedImages.js");
const folderPath = "./seeds/seedImages";
const getDate = require("../utils/getDate.js");

mongoose.connect("mongodb://localhost:27017/kristie-test");

const db = mongoose.connection;

db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Database connected");
});

const seedDB = async () => {
  const date = getDate();
  await Listing.deleteMany({});
  const imageUrls = getImageFilePaths(folderPath);
  const uploadedImages = await uploadImages(imageUrls);
  for (let i = 0; i < 37; i++) {
    const listing = new Listing({
      location: `${seedListings[i].location.city}, ${seedListings[i].location.state}`,
      geometry: {
        type: "Point",
        coordinates: [
          seedListings[i].location.longitude,
          seedListings[i].location.latitude,
        ],
      },
      title: `${seedListings[i].listingTitle}`,
      description: `${seedListings[i].description}`,
      price: seedListings[i].pricePerNight,
      bedrooms: seedListings[i].bedrooms,
      bathrooms: seedListings[i].bathrooms,
      images: [uploadedImages[i]],
      dateCreated: date,
    });
    await listing.save();
  }
};

seedDB().then(() => {
  mongoose.connection.close();
});

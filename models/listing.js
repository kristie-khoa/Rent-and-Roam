const mongoose = require("mongoose");
const Review = require("./review");
const { listingSchema } = require("../schemas");
const Schema = mongoose.Schema;

const ImageSchema = new Schema({
  url: String,
  filename: String,
});

ImageSchema.virtual("thumbnail").get(function () {
  return this.url.replace("/upload", "/upload/w_200");
});
ImageSchema.virtual("cardImg").get(function () {
  return this.url.replace("/upload", "/upload/c_fill,h_350,w_500");
});
ImageSchema.virtual("showImg").get(function () {
  return this.url.replace("/upload", "/upload/c_fill,h_500,w_630");
});

const opts = { toJSON: { virtuals: true } };

const ListingSchema = new Schema(
  {
    title: String,
    images: [ImageSchema],
    geometry: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    price: Number,
    bedrooms: Number,
    bathrooms: Number,
    description: String,
    location: String,
    dateCreated: String,
    reviews: [
      {
        type: Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
  },
  opts
);

ListingSchema.virtual("properties.popUpMarkup").get(function () {
  return `<a href="/listings/${this._id}">${this.title}</a>`;
});

ListingSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await Review.deleteMany({
      _id: {
        $in: doc.reviews,
      },
    });
  }
});

module.exports = mongoose.model("Listing", ListingSchema);

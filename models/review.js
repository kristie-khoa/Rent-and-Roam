const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
  body: String,
  rating: {
    type: Number,
    min: 1,
  },
});

module.exports = mongoose.model("Review", reviewSchema);

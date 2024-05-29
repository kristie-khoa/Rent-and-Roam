if (process.env.Node_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const { listingSchema, reviewSchema } = require("./schemas.js");
const methodOverride = require("method-override");
const Listing = require("./models/listing");
const asyncCatch = require("./utils/asyncCatch");
const flash = require("connect-flash");
const ExpressError = require("./utils/ExpressError");
const Review = require("./models/review");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user");
const multer = require("multer");
const { storage } = require("./cloudinary");
const upload = multer({ storage });
const { cloudinary } = require("./cloudinary");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });
const dbUrl = process.env.DB_URL;
const getDate = require("./utils/getDate.js");
getDate();

const MongoStore = require("connect-mongo");

// Initialize Express app
const app = express();

// MongoDB connection URI
const mongoURI = "mongodb://127.0.0.1:27017/kristie-test";
// const mongoURI = dbUrl;

async function connectToMongoDB() {
  try {
    // Connect to MongoDB using Mongoose
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

// Call the function to connect to MongoDB
connectToMongoDB();

// Event handler for MongoDB connection disconnected
mongoose.connection.on("disconnected", () => {
  console.log("MongoDB connection disconnected");
});

// Event handler for application termination or SIGINT signal (e.g., Ctrl + C)
process.on("SIGINT", async () => {
  try {
    await mongoose.connection.close();
    console.log("MongoDB connection disconnected through app termination");
    process.exit(0);
  } catch (error) {
    console.error("Error disconnecting from MongoDB:", error);
    process.exit(1);
  }
});

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// store session in mongodb

const store = MongoStore.create({
  mongoUrl: mongoURI,
  touchAfter: 24 * 60 * 60,
  crypto: {
    secret: "thisshouldbeabettersecret!",
  },
});

store.on("error", function (e) {
  console.log("SESSION STORE ERROR", e);
});

const sessionConfig = {
  store: store,
  name: "session",
  secret: "thisshouldbebettersecret!",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};
app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session()); //make sure you use after app.use(session())
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(flash());

//have access to these in every single template/view

app.use((req, res, next) => {
  res.locals.pathname = req.originalUrl;
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

//Define Middleware

const validateListing = (req, res, next) => {
  const { error } = listingSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  } else {
    next();
  }
};

const validateReview = (req, res, next) => {
  const { error } = reviewSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(msg, 400);
  } else {
    next();
  }
};

const isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    if (!req.session.returnTo) {
      req.session.returnTo = req.originalUrl;
    }
    req.flash("error", "Please sign in first!");
    return res.redirect("/login");
  }
  next();
};

const storeReturnTo = (req, res, next) => {
  if (!req.session.returnTo) {
  } else if (req.session.returnTo) {
    res.locals.returnTo = req.session.returnTo;
  }
  next();
};

const storeReturnToImportant = (req, res, next) => {
  req.session.returnTo = req.originalUrl;
  next();
};

//ROUTE HANDLERS

app.get("/", (req, res) => {
  res.render("home");
});

// listings

app.get(
  "/listings",
  asyncCatch(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 15;
    const skip = (page - 1) * perPage;

    const listings = await Listing.find().skip(skip).limit(perPage).exec();

    res.render("listings/index", {
      listings: listings,
      page: page,
      perPage: perPage,
    });
  })
);

app.get("/listings/new", storeReturnToImportant, isLoggedIn, (req, res) => {
  res.render("listings/new");
});

app.post(
  "/listings",
  isLoggedIn,
  upload.array("image"),
  validateListing,
  asyncCatch(async (req, res, next) => {
    const geoData = await geocoder
      .forwardGeocode({
        query: req.body.listing.location,
        limit: 1,
      })
      .send();

    const listing = new Listing(req.body.listing);
    listing.dateCreated = getDate();
    listing.geometry = geoData.body.features[0].geometry;
    listing.images = req.files.map((f) => ({
      url: f.path,
      filename: f.filename,
    }));
    await listing.save();
    console.log(listing);
    req.flash("success", "successfully made new listing");
    res.redirect(`/listings/${listing._id}`);
  })
);

// show listing

app.get(
  "/listings/:id",
  asyncCatch(async (req, res) => {
    const listing = await Listing.findById(req.params.id).populate("reviews");
    req.session.returnTo = req.originalUrl;
    console.log(listing.geometry.coordinates);
    res.render("listings/show", { listing });
  })
);

app.get(
  "/listings/:id/edit",
  storeReturnToImportant,
  isLoggedIn,
  asyncCatch(async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    console.log(listing);
    res.render("listings/edit", { listing });
  })
);

app.put(
  "/listings/:id",
  isLoggedIn,
  upload.array("image"),
  validateListing,
  asyncCatch(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findByIdAndUpdate(id, {
      ...req.body.listing,
    });
    const imgs = req.files.map((f) => ({ url: f.path, filename: f.filename }));
    listing.images.push(...imgs);
    await listing.save();
    if (req.body.deleteImages) {
      for (let filename of req.body.deleteImages) {
        await cloudinary.uploader.destroy(filename);
      }
      await listing.updateOne({
        $pull: { images: { filename: { $in: req.body.deleteImages } } },
      });
    }
    req.flash("success", "Successfully updated listing!");
    res.redirect(`/listings/${listing._id}`);
  })
);

app.delete(
  "/listings/:id",
  isLoggedIn,
  asyncCatch(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findByIdAndDelete(id);
    req.flash("success", `${listing.title} successfully deleted`);
    res.redirect("/listings");
  })
);

// reviews

app.post(
  "/listings/:id/reviews",
  isLoggedIn,
  validateReview,
  asyncCatch(async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    const review = new Review(req.body.review);
    listing.reviews.push(review);
    await review.save();
    await listing.save();
    res.redirect(`/listings/${listing._id}`);
  })
);

app.delete(
  "/listings/:id/reviews/:reviewId",
  isLoggedIn,
  asyncCatch(async (req, res) => {
    const { id, reviewId } = req.params;
    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    req.flash("success", "review successfully deleted");
    res.redirect(`/listings/${id}`);
  })
);

// new users

app.get("/register", (req, res) => {
  res.render("users/register");
});

app.post(
  "/register",
  asyncCatch(async (req, res, next) => {
    try {
      const { email, username, password } = req.body;
      const user = new User({ email, username });
      const registeredUser = await User.register(user, password);
      req.login(registeredUser, function (err) {
        if (err) {
          return next(err);
        }
        req.flash("success", `Welcome to Yelp camp, ${req.user.username}!`);
        res.redirect("/listings");
      });
    } catch (e) {
      req.flash("error", e.message);
      res.redirect("/register");
    }
  })
);

app.get("/login", (req, res) => {
  res.render("users/login");
});

app.post(
  "/login",
  storeReturnTo,
  passport.authenticate("local", {
    failureFlash: true,
    failureRedirect: "/login",
  }),
  (req, res) => {
    req.flash("success", `welcome back ${req.user.username}!`); //user is given by passport
    const redirectUrl = res.locals.returnTo || "/listings";
    delete req.session.returnTo;
    res.redirect(redirectUrl);
  }
);

app.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      next(err);
    }
    req.flash("success", "Succesfully Logged Out");
    res.redirect("/listings");
  });
});

app.all("*", (req, res, next) => {
  next(new ExpressError("Page Not Found", 404));
});

app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = "Oh No, Something Went Wrong!";
  res.status(statusCode).render("error", { err });
});

app.listen(3000, () => {
  console.log("Serving on port 3000");
});

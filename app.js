//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const FacebookStrategy = require('passport-facebook').Strategy;

const app = express();
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());//use passport for dealing with the session

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true});
mongoose.set("useCreateIndex", true);

const groupSchema = new mongoose.Schema({
  name: String,
  description: String,
  creatorId: String,
  posts: [],
  members:[] //Member will be an object with id, type(owner, member, creator). Creator is also the owner.
});
const Group = mongoose.model("Group", groupSchema);

const postsSchema = new mongoose.Schema({
  title: String,
  description: String,
  type: String
});
const Post = mongoose.model("Post", postsSchema);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  posts:[],
  groups: []
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = mongoose.model("User", userSchema);

// use static authenticate method of model in LocalStrategy
passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


app.get("/", function(req, res){
  res.render("home");
});

app.get("/auth/google",
  passport.authenticate("google", {scope: ["profile"]}));

app.get('/auth/facebook',
  passport.authenticate('facebook'));

app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/groups');
  });

app.get('/auth/facebook/secrets',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/groups');
  });

  app.get("/groups", function(req,res){
    if (req.isAuthenticated()){
      const myOwnedGroups = [];
      const myMembershipGroups = [];
      const otherGroups = [];

      Group.find({}, function(error, foundGroups){
        if (error){
          console.log(error);
        }else{
          foundGroups.forEach(function(group){
            if(group.creatorId == req.user._id){
              myOwnedGroups.push(group);
            }else if(group.members.includes(req.user._id)){
              myMembershipGroups.push(group);
            } else{
              otherGroups.push(group);
            }
          })
          console.log(myOwnedGroups);
          console.log(myMembershipGroups);
          console.log(otherGroups);
          res.render("groups", {myGroups: myOwnedGroups, myMembershipGroups: myMembershipGroups, otherGroups:otherGroups});
          //creatorId:req.user._id
        }
      });
    } else{
      res.redirect("/login");
    }
  });

app.get("/login", function(req, res){
  res.render("login");
});

app.get("/logout", function(req,res){
  req.logout();
  res.redirect("/");
});

app.get("/register", function(req, res){
  res.render("register");
});

app.get("/secrets", function(req,res){
  posts = [];
  console.log("In secrets get");
  console.log(req.body);
  User.find({"posts":{$ne:null}}, function(error, foundUsers){
    if (error){
      console.log(error);
    } else{
      if (foundUsers){
        foundUsers.forEach(function(user){
          user.posts.forEach(function(post){
            if (post.type == "events"){
              posts.push(post);
            }
          })
        })
        res.render("secrets", {posts: posts});
      }
    }
  })
});

app.get("/secrets/:title", function(req,res){
  posts = [];
  // User.find({ "posts.$.title": req.params.title}, {'posts.$' : 1}, function(err, foundPosts){
  //   if (err){
  //     console.log(err);
  //   } else{
  //     console.log(foundPosts);
  //   }
  // });
  console.log(req.params.title);
  User.find({"posts":{$ne:null}}, function(error, foundUsers){
    if (error){
      console.log(error);
    } else{
      if (foundUsers){
        foundUsers.forEach(function(user){
          user.posts.forEach(function(post){
            if (post.type == req.params.title){
              posts.push(post);
            }
          })
        })
        res.render("secrets", {posts: posts});

        console.log(foundUsers);
      }
    }
  })
});

app.get("/submit", function(req, res){
  if(req.isAuthenticated()){
    res.render("submit");
  } else{
    res.redirect("/login");
  }
});

app.post("/groups", function(req, res){
  //console.log("Inside the current test");
  //console.log(req.user._id);
  if (req.isAuthenticated()){
    //Save the group into mygroup db
    const newGroup = new Group({
      name: req.body.groupName,
      description: req.body.groupDescription,
      creatorId: req.user._id
    });
    newGroup.save();
    res.redirect("groups");
  } else{
    res.redirect("/login");
  }
});

app.post("/login", function(req, res){

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    if (err){
      console.log(err);
    }else{
      passport.authenticate("local")(req,res,function(){
        res.redirect("/secrets");
      });
    }
  });
});



app.post("/register", function(req, res){
  User.register({username: req.body.username}, req.body.password, function(err, user){
    if (err){
      console.log(err);
      res.redirect("/register");
    } else{
      passport.authenticate("local")(req, res, function(){
        res.redirect("/secrets");
      })
    }
  })
});

app.post("/submit", function(req, res){
  const title = req.body.title;
  const description = req.body.description;
  const type = req.body.type;

  const newPost  = new Post({
    title: title,
    description: description,
    type: type
  });

  User.findById(req.user.id, function(err, foundUser){
    if (err){
      console.log(err);
    } else{
      if (foundUser){
        if (foundUser.posts){
          foundUser.posts.push(newPost);
        } else{
          foundUser.posts = [newPost];
        }
        foundUser.save(function(){
          res.redirect("/secrets");
        })
      }
    }
  })
});

app.post("/secrets", function(req, res){
  console.log("In secret post");
  console.log(req.body);
});

app.listen(3000, function(){
  console.log("Server is running on port 3000");
});

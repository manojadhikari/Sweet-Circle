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
const _ = require('lodash');


const homeStartingContent = "Lacus vel facilisis volutpat est velit egestas dui id ornare. Semper auctor neque vitae tempus quam. Sit amet cursus sit amet dictum sit amet justo. Viverra tellus in hac habitasse. Imperdiet proin fermentum leo vel orci porta. Donec ultrices tincidunt arcu non sodales neque sodales ut. Mattis molestie a iaculis at erat pellentesque adipiscing. Magnis dis parturient montes nascetur ridiculus mus mauris vitae ultricies. Adipiscing elit ut aliquam purus sit amet luctus venenatis lectus. Ultrices vitae auctor eu augue ut lectus arcu bibendum at. Odio euismod lacinia at quis risus sed vulputate odio ut. Cursus mattis molestie a iaculis at erat pellentesque adipiscing.";
const aboutContent = "Hac habitasse platea dictumst vestibulum rhoncus est pellentesque. Dictumst vestibulum rhoncus est pellentesque elit ullamcorper. Non diam phasellus vestibulum lorem sed. Platea dictumst quisque sagittis purus sit. Egestas sed sed risus pretium quam vulputate dignissim suspendisse. Mauris in aliquam sem fringilla. Semper risus in hendrerit gravida rutrum quisque non tellus orci. Amet massa vitae tortor condimentum lacinia quis vel eros. Enim ut tellus elementum sagittis vitae. Mauris ultrices eros in cursus turpis massa tincidunt dui.";
const contactContent = "Scelerisque eleifend donec pretium vulputate sapien. Rhoncus urna neque viverra justo nec ultrices. Arcu dui vivamus arcu felis bibendum. Consectetur adipiscing elit duis tristique. Risus viverra adipiscing at in tellus integer feugiat. Sapien nec sagittis aliquam malesuada bibendum arcu vitae. Consequat interdum varius sit amet mattis. Iaculis nunc sed augue lacus. Interdum posuere lorem ipsum dolor sit amet consectetur adipiscing elit. Pulvinar elementum integer enim neque. Ultrices gravida dictum fusce ut placerat orci nulla. Mauris in aliquam sem fringilla ut morbi tincidunt. Tortor posuere ac ut consequat semper viverra nam libero.";

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

mongoose.connect("mongodb+srv://admin-manoj:Test123@learn-together-uomac.mongodb.net/userDB", {useNewUrlParser: true});
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
  facebookId:String,
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
    callbackURL: "http://localhost:3000/auth/facebook/secrets",
    profileFields: ['id', 'displayName', 'photos', 'email']
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile.id);
    User.findOrCreate({facebookId: profile.id }, function (err, user) {
      if (err){
        // console.log("Error saving facebook ID");
        console.log(err);
      } else{
        return cb(err, user);
      }

    });
  }
));


app.get("/", function(req, res){
  res.render("home");
});

app.get("/about", function(req, res){
  res.render("about", {aboutContent: aboutContent});
});

app.get("/contact", function(req, res){
  res.render("contact", {contactContent: contactContent});
});

app.get("/auth/google",
  passport.authenticate("google", {scope: ["profile"]}));

app.get('/auth/facebook',
  passport.authenticate('facebook', {scope:["public_profile"]}));

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
  }
);

app.get('/delete/:groupId', function(req, res){
  Group.findByIdAndDelete(req.params.groupId, function(err){
    if(err){
      console.log(err);
    } else{
      console.log("Deleted Group with ID" + req.params.groupId);
    }
    res.redirect('/groups');
  });
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

app.get('/join/:groupId', function(req, res){
  if(req.isAuthenticated()){
    Group.findById(req.params.groupId, function(err, foundGroup){
      if(err){
        console.log(err);
      } else{
        if(foundGroup.members){
          foundGroup.members.push(req.user._id);
        } else{
          foundGroup.members = [req.user._id];
        }
        foundGroup.save();
      }
      res.redirect('/groups');
    });
  } else{
    res.redirect('/');
  }
});

app.get('/leave/:groupId', function(req, res){
  if(req.isAuthenticated()){
    Group.findById(req.params.groupId, function(err, foundGroup){
      if(err){
        console.log(err);
      } else{
        if(foundGroup.members){
          const index = foundGroup.members.indexOf(req.user._id);
          if (index > -1) {
            foundGroup.members.splice(index,1);
          }
        }
        foundGroup.save();
      }
      res.redirect('/groups');
    });
  } else{
    res.redirect('/');
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
  // User.find({"posts":{$ne:null}}, function(error, foundUsers){
  //   if (error){
  //     console.log(error);
  //   } else{
  //     if (foundUsers){
  //       foundUsers.forEach(function(user){
  //         user.posts.forEach(function(post){
  //           if (post.type == "event"){
  //             posts.push(post);
  //           }
  //         })
  //       })
  //       res.render("secrets", {posts: posts, groupID:[]});
  //     }
  //   }
  // })
});

app.get("/posts/:groupID/:postType", function(req,res){
  posts = [];
  console.log("In secrets get groupid + type")
  // console.log(typeof(req.params[0]));
  console.log(req.params);
  const groupID = req.params.groupID;
  Group.findById(groupID, function(err, foundGroup){
    if (err){
      console.log("Got error");
      console.log(err);
    } else{
      if (foundGroup.posts){
        console.log("found matching posts")
        foundGroup.posts.forEach(function(post){
            posts.push(post);
        });
      }
      res.render("secrets", {posts: posts, groupID:groupID});
    }
  });

});

app.get("/submit", function(req, res){
  console.log("Body on submit get");
  console.log(req.body);
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
        res.redirect("/groups");
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
        res.redirect("/groups");
      })
    }
  })
});

app.post("/submit", function(req, res){
  if (req.isAuthenticated()){
    console.log("Logger on submit post");
    console.log(req.body);
    const title = req.body.postName;
    const description = req.body.postDescription;
    const newPost  = new Post({
      title: title,
      description: description
    });
    const posts = [];
    Group.findById(req.body.groupID, function(err, foundGroup){
      if (err){
        console.log(err);
      } else{
          if (foundGroup){
            if (foundGroup.posts){
              foundGroup.posts.push(newPost);
            }else{
              foundGroup.posts = [newPost];
            }
            foundGroup.save();
            foundGroup.posts.forEach(function(post){
                posts.push(post);
            });
            res.render("secrets", {groupID:req.body.groupID, posts:posts});
        }
      }
    });
  }else{
    res.redirect("/");
  }
});

app.post("/secrets", function(req, res){
  console.log("In secret post");
  console.log(req.body);
  //Get all posts with the groupID and then call get Secret with posts params
  posts = [];
  Group.find({_id:req.body.groupID}, function(error, foundGroup){
    if (error){
      console.log(error);
    } else{
        if (foundGroup.posts){
          foundGroup.posts.forEach(function(post){
            if (post.type == "events"){
              posts.push(post);
            }
          })
        }else{
          console.log("No posts found in secrets post");
        }
        res.render("secrets", {posts: posts, groupID: req.body.groupID});
      }
  })
});

app.listen(process.env.PORT || 3000, function(){
  console.log("Server is running on port 3000");
});

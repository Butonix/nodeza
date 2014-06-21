var _ = require('lodash');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var GitHubStrategy = require('passport-github').Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var User = require('../models/user');
var secrets = require('./secrets');
var Tokens = require('../models/token');


passport.serializeUser(function(user, done) {
  done(null, user.get('id'));
});


passport.deserializeUser(function(id, done) {
  User.forge({id: id}).fetch({withRelated: ['role', 'tokens']}).then(function(user) {
    done(false, user);
  });
});


// Sign in using Email and Password.
passport.use(new LocalStrategy({ usernameField: 'email' }, function(email, password, done) {
  User.forge({email: email})
  .fetch()
  .then(function(user) {
    if (!user) {
      return done(null, false, { message: 'Email ' + email + ' not found'});
    }

    user.comparePassword(password)
    .then(function(isMatch) {
      if (isMatch) {
        done(null, user);
      } else {
        done(null, false, { message: 'Invalid password.' });
      }
    })
    .otherwise(function () {
      done(null, false, { message: 'Invalid password.' });
    });
  })
  .otherwise(function () {
    done(null, false, {message: 'Database error'});
  });
}));


// Sign in with GitHub.
passport.use(new GitHubStrategy(secrets.github, function (req, accessToken, refreshToken, profile, done) {

   console.log(profile);
  // if the user is already logged in
  if (req.user) {
    var user = new User(); 
    var existingUser = req.user;
    

    user.query(function (qb) {
      qb.where('github', '=', profile.id).orWhere('email', '=', profile.email);
    })
    .fetch()
    .then(function (model) {
      // account already linked
      if(model) {
        req.flash('errors', {msg: 'There is already a GitHub account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        done({'errors': {msg: 'There is already a GitHub account that belongs to you. Sign in with that account or delete it, then link it with your current account.' }}); 
      }
      else {
        existingUser.set({
          github: profile.id,
          name: existingUser.get('name') || profile.displayName,
          image_url: existingUser.get('image_url') || profile._json.avatar_url,
          location: existingUser.get('location') || profile._json.location,
          website: existingUser.get('website') || profile._json.blog || profile._json.profileUrl,
          role_id: existingUser.get('role_id') || 1,
          location: existingUser.get('location') || profile._json.location,
          about: existingUser.get('about') || profile._json.bio,
          role_id: existingUser.get('role_id') || 1
        }); 

        existingUser.save()
        .then(function (model) {
          Tokens.forge({
            user_id: model.get('id'), 
            kind: 'github',
            accessToken: accessToken
          })
          .save()
          .then(function () {
            req.flash('info', { msg: 'GitHub account has been linked.' });
            done(false, model);
          })
          .otherwise(function () {
            req.flash('errors', { msg: 'Database error. Failed to save token'});
            done(false, model);
          });
        })
        .otherwise(function () {
          req.flash('errors', { msg: 'Database error. Failed to link GitHub account'});
          done({'errors': {msg: 'Database error. Failed to link GitHub account'}}, existingUser);      
        });
      }    
    })
    // Database error 
    .otherwise(function () {
      req.flash('errors', { msg: 'Database error. Failed to open Database'});
      done({'errors': {msg: 'Database error. Failed to open Database'}}, user);
    });
  } 

  // if the user is not logged in
  else {
    var isNewAccount = false;

    User.forge({github: profile.id})
    .fetch()
    .then(function (existingUser) {
      if (existingUser) {
        return done(null, existingUser);
      }

      User.forge({email: profile._json.email})
      .fetch()
      .then(function (existingEmailUser) {
        var user, roleid;

        if (existingEmailUser) { 
          user = existingEmailUser; 
          roleid = user.get('role_id');      
        } else {
          isNewAccount = true;
          user = new User();
          roleid = 1;
        }

        user.set({
          email: profile._json.email,
          github: profile.id,
          name: profile.displayName,
          image_url: profile._json.avatar_url,
          location: profile._json.location,
          website: profile._json.blog,
          role_id: roleid
        });

        user.save()
        .then(function (model) {
          Tokens.forge({
            user_id: model.get('id'), 
            kind: 'github',
            accessToken: accessToken
          })
          .save()
          .then(function () {
            if (isNewAccount) {
              req.isNewAccount = true;
              req.flash('info', { msg: 'Account successfully created! You can may also set your password to activate email login.' });
            }
            else {
              req.flash('info', { msg: 'GitHub account has been linked.' });
            }
              
            done(false, model);
          })
          .otherwise(function () {
            req.flash('errors', { msg: 'Database error. Failed to save token'});
            done(false, model);
          });
        })
        .otherwise(function(err) {done(err);});
      });
    })
    .otherwise(function () {
      req.flash('errors', { msg: 'Database error. Failed to access'});
      done({'errors': {msg: 'Database error. Failed to access'}}, user);
    });
  }
}));



// Sign in with Twitter
passport.use(new TwitterStrategy(secrets.twitter, function (req, accessToken, tokenSecret, profile, done) {
  if (req.user) {
    User.forge({twitter: profile.id})
    .fetch()
    .then(function (existingUser) {
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a Twitter account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });

        done(false, existingUser);
      } 
      else {
        var user = req.user;

        user.set({
          twitter: profile.id,
          name: user.get('name') || profile.displayName,
          location: user.get('location') || profile._json.location,
          image_url: user.get('image_url') || profile._json.profile_image_url
        });

        user.save()
        .then(function (model) {
          req.flash('info', {msg: 'Twitter account has been linked.'});

          Tokens.forge({
            user_id: model.get('id'), 
            kind: 'twitter',
            accessToken: accessToken,
            tokenSecret: tokenSecret
          })
          .save()
          .then(function () {
            done(false, model);
          })
          .otherwise(function(err) {done(err);});
        });
      }
    })
    .otherwise(function(err) {done(err);});
  } 
  else {
    User.forge({twitter: profile.id})
    .fetch()
    .then(function (existingUser) {
      if (existingUser) {
        return done(false, existingUser);
      }
      else {
        done('You have not linked your twitter with ours, please login using your email and link your twitter account.');
      }
    })
    .otherwise(function(err) {
      done(err);
    });
  }
}));



// Sign in with Google.
passport.use(new GoogleStrategy(secrets.google, function (req, accessToken, refreshToken, profile, done) {
  if (req.user) {
    User.forge({google: profile.id})
    .fetch()
    .then(function (existingUser) {
      if (existingUser) {
        req.flash('errors', {msg: 'There is already a Google account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        done('There is already a Google account that belongs to you.');
      } 
      else {
        var user = req.user;

        user.set({
          google: profile.id,
          name: user.get('name') || profile.displayName,
          gender: user.get('gender') || profile._json.gender,
          image_url: user.get('image_url') || profile._json.picture
        });

        user.save()
        .then(function (model) {
          req.flash('info', {msg: 'Google account has been linked.'});

          Tokens.forge({
            user_id: model.get('id'), 
            kind: 'google',
            accessToken: accessToken
          })
          .save()
          .then(function () {
            done(false, model);
          })
          .otherwise(function(err) {done(err);});
        })
        .otherwise(function(err) {done(err);});
      }
    });
  } 
  else {
    User.forge({google: profile.id})
    .fetch()
    .then(function (existingUser) {
      if (existingUser) {
        return done(false, existingUser);
      }

      User.forge({email: profile._json.email})
      .fetch()
      .then(function (existingEmailUser) {
        var user, info;

        if (existingEmailUser) { 
          info = {msg: 'Google account has been linked.'};
          user = existingEmailUser;       
        } 
        else {
          info = {msg: 'Account successfully created! You can may also set your password to activate email login.'};
          user = new User();
        }

        user.set({
          email: user.get('email') || profile._json.email,
          google: user.get('google') || profile.id,
          name: user.get('name') || profile.displayName,
          gender: user.get('gender')  || profile._json.gender,
          image_url: user.get('image_url')  || profile._json.picture,
          role_id: user.get('role_id') || 1
        });

        user.save()
        .then(function (model) {
          Tokens.forge({
            user_id: model.get('id'), 
            kind: 'google',
            accessToken: accessToken
          })
          .save()
          .then(function () {
            req.flash('info', info);
            done(false, model);
          })
          .otherwise(function(err) {done(err);});
        })
        .otherwise(function(err) {done(err);});
      });
    })
    .otherwise(function(err) {done(err);});
  }
}));



// Login Required middleware.
exports.isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  res.redirect('/login');
};



exports.isNotAuthenticated = function (req, res, next) {
  if (!req.isAuthenticated()) {
    return next();
  }
  
  res.redirect('/');
};

// Authorization Required middleware.

exports.isAuthorized = function (req, res, next) {
  var provider = req.path.split('/').slice(-1)[0];
  var tokens = req.user.related('tokens').toJSON();

  if (_.findWhere(tokens, { kind: 'github' })) {
    next();
  } else {
    res.redirect('/auth/' + provider);
  }
};


exports.isUserAdmin = function (req, res, next) {

  if (req.user && req.user.related('role').get('role') === 'Super Administrator') {
    next();
  } else {
    req.flash('errors', { msg: 'You are not authorized to perform that action' });
    res.redirect('/');
  }
};
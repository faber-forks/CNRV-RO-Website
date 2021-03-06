var async = require('async')
  , request = require('request')
  , utils = require('../modules/utils')
  , requireAuth = require('../helpers/passport').requireAuth
  , security = require('../modules/security');

var Posts = function() {

  this.before(requireAuth, { except: ['index', 'show', 'search'] });
  this.before(security.userHasAccess, { only: ['edit', 'update', 'remove'], async: true });
  this.respondsWith = ['html', 'json'];

  this.index = function(req, resp, params, q, viewOptions) {
    var options = {sort: {createdAt: 'desc'}, limit: 10};

    // Parse 'page' parameter
    if (params.page) {
      options.skip = parseInt(params.page*10);
    }

    // Respond with posts
    utils.defaultIndex.bind(this)({
      posts: async.apply(async.waterfall, [
        async.apply(geddy.model.Post.all, q, options)
      , utils.fetchAssociations({fetch: ['User', 'Category', 'Comments']})
      ])
    , totalPosts: function(callback) {
        geddy.model.Post.all(q, null, function(err, posts) {
          callback(err, posts.length);
        });
      }
    }, { respond: viewOptions || {template: 'app/views/posts/index'}, requiredRes: ['posts'] });
  };

  this.add = function(req, resp, params) {
    utils.defaultIndex.bind(this)({
      categories: async.apply(geddy.model.Category.all, null, {sort: {name: 'asc'}})
    });
  };

  this.show = function(req, resp, params) {
    var self = this;

    utils.defaultIndex.bind(this)({
      post: async.apply(async.waterfall, [
        async.apply(geddy.model.Post.first, params.id)
      , utils.fetchAssociations({fetch: ['User', 'Category', 'Comments', {for: 'comments', fetch: ['User']}]})
      , utils.checkUserHasAccessToEdit.bind(self)
      ])
    }, { requiredRes: ['post'] });
  };

  this.edit = function(req, resp, params) {
    utils.defaultIndex.bind(this)({
      post: async.apply(async.waterfall, [
        async.apply(geddy.model.Post.first, params.id)
      , utils.fetchAssociations({fetch: ['Category']})
      ])
    , categories: async.apply(geddy.model.Category.all, null, {sort: {name: 'asc'}})
    }, { requiredRes: ['post'] });
  };

  this.search = function(req, resp, params) {
    var self = this
      , searchUrl = process.env.SEARCHBOX_URL + '/posts/_search?q=' + params.q;

    async.series({
      posts: async.apply(async.waterfall, [
        function(callback) {
          try {
            request.get(searchUrl, callback);
          } catch(ex) {
            callback(ex);
          }
        }
      , function(resp, body, callback) {
          var parsed = JSON.parse(body);
          var queryIds = [];

          if (parsed && parsed.hits && parsed.hits.hits) {
            var data = parsed.hits.hits
            for (var i = 0; i < data.length; i++) {
              queryIds.push({ id: data[i]._id });
            }
          }

          if (queryIds.length) {
            geddy.model.Post.all({ or: queryIds }, function(err, posts) {
              if (err) throw err;
              callback(null, posts);
            });
          } else {
            callback(null, null);
          }
        }
      , function(posts, callback) {
        if (posts) {
          utils.fetchAssociations({fetch: ['User', 'Category', 'Comments']})(posts, callback);
        } else {
          callback(null, posts);
        }
      }
      ])
    , pageData: async.apply(utils.loadPageData, null, self.session)
    }, function(err, data) {
      if (err) throw err;
      data.searchTerm = params.q;
      self.respond(data);
    });
  };

  this.review = function(req, resp, params) {
    utils.defaultIndex.bind(this)({
      posts: async.apply(geddy.model.Post.all, {reviewed: false})
    }, { respond: {template: 'app/views/posts/review'} });
  };

  this.create = utils.defaultCreate.bind(this, true, 'Postare invalidă.', 'Postarea a fost adaugată.');
  this.update = utils.defaultUpdate.bind(this, true, 'Postare invalidă.', 'Postarea a fost salvată.');
  this.remove = utils.defaultRemove.bind(this, true, 'Postarea a fost ştearsă.');

};

exports.Posts = Posts;

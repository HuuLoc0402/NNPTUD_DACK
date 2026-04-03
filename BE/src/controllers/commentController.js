const Comment = require('../models/Comment');

exports.createComment = (payload) => {
  const comment = new Comment(payload);
  return comment.save();
};

exports.findComments = (filter = {}) => {
  return Comment.find(filter)
    .populate('user', 'fullName avatar')
    .populate('product', 'name slug')
    .sort({ createdAt: -1 });
};

exports.findCommentById = (commentId) => {
  return Comment.findById(commentId)
    .populate('user', 'fullName avatar')
    .populate('product', 'name slug');
};

exports.updateComment = (commentId, updateData) => {
  return Comment.findByIdAndUpdate(commentId, updateData, {
    new: true,
    runValidators: true
  })
    .populate('user', 'fullName avatar')
    .populate('product', 'name slug');
};

exports.deleteComment = (commentId) => {
  return Comment.findByIdAndDelete(commentId);
};

exports.formatComment = (commentDoc) => {
  const comment = commentDoc.toObject ? commentDoc.toObject() : commentDoc;
  return {
    ...comment,
    user: comment.user
      ? {
          ...comment.user,
          fullname: comment.user.fullName
        }
      : null
  };
};
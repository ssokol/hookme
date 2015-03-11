var express = require('express');
var chatbot = require('../controllers/chatbot');
var config = require('../util/config');

var router = express.Router();

/* GET home page. */
router.get('/', function (req, res) {
  //res.render('index', { title: 'Express' });
});

router.get('/settings', function (req, res) {
	res.send({ 
		appId: config.appId,
		baseUrl: config.baseURL
	});
});

router.post('/token', function(req, res) {
  console.log("client is requesting a token for: " + req.body.endpointId);
  chatbot.getToken(req.body.endpointId, function(err, req, body) {
    res.status(200).json(body);
  });
});

/* POST messages from Respoke webhook service */
router.post('/', function(req, res) {
  chatbot.process(req);
});

module.exports = router;

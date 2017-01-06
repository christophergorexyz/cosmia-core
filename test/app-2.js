var cosmia = require('../dist/index');
var path = require('path');
cosmia(path.resolve('./test/src'), path.resolve('./test/dist'), {
    'copyright-year': new Date().getFullYear()
});

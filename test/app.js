//an example of how an app would utilize the Builder
'use strict';

var cosmia = require('../index');

cosmia.setup('./test/src').then(() => {
    console.log(cosmia.compilePage('sub-section/index'));
});

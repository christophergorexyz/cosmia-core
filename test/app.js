//an example of how an app would utilize the Builder
'use strict';

var cosmia = require('../dist/index');

cosmia.setup('./test/src', {
    'copyright-year': new Date().getFullYear()
}).then(() => {
    console.log(cosmia.compilePage('sub-section/index', {
        title: 'my custom title'
    }));
});

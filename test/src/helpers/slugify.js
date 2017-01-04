'use strict';
module.exports = {
    slugify: function (component, options) {
        var slug = component.replace(/[^\w\s]+/gi, '').replace(/ +/gi, '-');
        return slug.toLowerCase();
    }
};

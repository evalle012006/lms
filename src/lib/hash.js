const bcrypt = require("bcryptjs");

export { hash };

function hash(text) {
    const hash = bcrypt.genSalt(10, function(saltError, salt) {
        if (saltError) {
            throw saltError;
        } else {
            bcrypt.hash(text, salt, function(hashError, hash) {
                if (hashError) {
                    throw hashError;
                } else {
                    return hash;
                }
            });
        }
    });

    return hash;
}
class InvalidTransitionError extends Error {
    constructor(message) {
        super(message);
        this.name = "InvalidTransitionError";
        this.statusCode = 400;
    }
}

class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "NotFoundError";
        this.statusCode = 404;
    }
}

class ConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = "ConflictError";
        this.statusCode = 409;
    }
}

// MAKE SURE THIS OBJECT EXPORT IS CORRECT
module.exports = { 
    InvalidTransitionError, 
    NotFoundError, 
    ConflictError 
};
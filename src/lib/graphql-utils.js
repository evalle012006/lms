// utils/graphql-error-handler.js

export const formatGraphQLError = (error) => {
    if (!error) return null;
  
    // Handle network errors
    if (error.networkError) {
      const networkErrors = error.networkError.result?.errors;
      if (networkErrors) {
        return networkErrors.map(err => ({
          message: err.message,
          path: err.path?.join(' > '),
          locations: err.locations,
          extensions: err.extensions,
          details: parseGraphQLError(err.message)
        }));
      }
      return [{
        message: error.networkError.message,
        type: 'NetworkError'
      }];
    }
  
    // Handle GraphQL errors
    if (error.graphQLErrors) {
      return error.graphQLErrors.map(err => ({
        message: err.message,
        path: err.path?.join(' > '),
        locations: err.locations,
        extensions: err.extensions,
        details: parseGraphQLError(err.message)
      }));
    }
  
    // Handle plain error objects
    if (error.message) {
      return [{
        message: error.message,
        details: parseGraphQLError(error.message)
      }];
    }
  
    return [{
      message: 'An unknown error occurred',
      raw: error
    }];
  };
  
  // Helper to parse specific GraphQL error messages
  const parseGraphQLError = (errorMessage) => {
    // Parse type mismatch errors
    const typeMatchRegex = /parsing (.+) failed, expected (.+), but encountered (.+)/;
    const typeMatch = errorMessage.match(typeMatchRegex);
    if (typeMatch) {
      return {
        type: 'TypeMismatch',
        field: typeMatch[1],
        expected: typeMatch[2],
        received: typeMatch[3]
      };
    }
  
    // Parse validation errors
    const validationRegex = /Field "(.+)" (.+)/;
    const validationMatch = errorMessage.match(validationRegex);
    if (validationMatch) {
      return {
        type: 'ValidationError',
        field: validationMatch[1],
        issue: validationMatch[2]
      };
    }
  
    return null;
  };
  
  // Logger wrapper for GraphQL errors
  export const logGraphQLError = (error, context = {}) => {
    const formattedError = formatGraphQLError(error);
    
    console.error('GraphQL Error:', {
      context,
      errors: formattedError,
      timestamp: new Date().toISOString()
    });
  
    return formattedError;
  };
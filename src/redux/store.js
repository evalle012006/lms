import { createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import { createWrapper } from 'next-redux-wrapper';
import rootReducer from './reducers/rootReducer';

// const middleware = [thunk];

const composeEnhancers =
    typeof window === 'object' &&
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ? 
        window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({}) : compose;

const makeStore = () => createStore(rootReducer, composeEnhancers(applyMiddleware(thunk)))

export const wrapper = createWrapper(makeStore) 
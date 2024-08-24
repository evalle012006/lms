import { createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import { createWrapper, HYDRATE } from 'next-redux-wrapper';
import rootReducer from './reducers/rootReducer';

const composeEnhancers =
    typeof window === 'object' &&
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ? 
        window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({}) : compose;

const masterReducer = (state, action) => {
    if (action.type === HYDRATE) {
        return {
            ...state,
            ...action.payload
        };
    } else {
        return rootReducer(state, action);
    }
};

const makeStore = () => createStore(
    masterReducer,
    composeEnhancers(applyMiddleware(thunk))
);

export const wrapper = createWrapper(makeStore);
import { configureStore } from '@reduxjs/toolkit';
import { createWrapper, HYDRATE } from 'next-redux-wrapper';
import rootReducer from './reducers/rootReducer';

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

const makeStore = () => 
    configureStore({
        reducer: masterReducer,
        middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
        devTools: process.env.NODE_ENV !== 'production',
    });

export const wrapper = createWrapper(makeStore);
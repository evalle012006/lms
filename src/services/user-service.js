import { BehaviorSubject } from 'rxjs';
import getConfig from 'next/config';
import Router from 'next/router';
import { fetchWrapper } from '@/lib/fetch-wrapper';

const { publicRuntimeConfig } = getConfig();
const baseUrl = `${publicRuntimeConfig.apiUrl}/users`;
const userSubject = new BehaviorSubject(process.browser && JSON.parse(localStorage.getItem('acuser')));

export const userService = {
    user: userSubject.asObservable(),
    get userValue() { return userSubject.value },
    login,
    logout,
    update
}

function login(username, password) {
    const apiURL = process.env.NEXT_PUBLIC_API_URL + 'authenticate';
    return fetchWrapper.post(apiURL, { username, password })
        .then(data => {
            // user login logic here!!
            if (!data.success && data.error == 'NO_PASS') {
                const redirect = `/forgot-password?action=reset&id=${data.user}`;
                Router.push(redirect);
            } else {
                // save to local storage
                localStorage.setItem('acuser', JSON.stringify(data.user));

                // set subject 
                userSubject.next(data);
            }
            return data;
        });
}

function logout() {
    // localStorage.removeItem('selectedBranch');
    localStorage.removeItem('selectedLO');
    localStorage.removeItem('cashCollectionDateFilter');
    localStorage.removeItem('acuser');
    userSubject.next(null);
    Router.push('/login');
}

function update(data) {
    const newData = { ...userSubject.value, ...data };
    localStorage.setItem('acuser', JSON.stringify(newData));

    return newData;
}
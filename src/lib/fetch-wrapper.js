import getConfig from 'next/config';
import { userService } from '@/services/user-service';

const { publicRuntimeConfig } = getConfig();

export const fetchWrapper = { get, post, put, sendData, delete: _delete, postCors };

function handleResponse(response) {
    return response.text().then(text => {
        const data = text && JSON.parse(text);

        if (!response.ok) {
            if ([401, 403, 409].includes(response.status) && userService.userValue) {
                // userService.logout();
                window.location.href = '/logout';
            }

            const error = (data && data.message) || response.statusText;
            return Promise.reject(error);
        }

        return data;
    });
}

function isApiUrl(url) {
  const apiUrl = publicRuntimeConfig.apiUrl ?? '';
  if (apiUrl.startsWith('/') && url.startsWith('http')) {
    url = new URL(url).pathname;
  }
//   console.log(url, apiUrl, url.startsWith(apiUrl))
  return url.startsWith(apiUrl);
}

function authHeader(url) {
    let user = userService.userValue;
    if (user && user.hasOwnProperty('user')) {
        user = user.user;
    }
    const isLoggedIn = user && user.token;
    if (isLoggedIn && isApiUrl(url)) {
        return { Authorization: `Bearer ${user.token}` };
    } else {
        return {};
    }
}

function get(url) {
    const requestOptions = {
        keepalive: true,
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...authHeader(url) },
        credentials: 'include'
    };

    return fetch(url, requestOptions).then(handleResponse);
}

function post(url, body) {
    const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(url) },
        credentials: 'include',
        body: JSON.stringify(body)
    };

    return fetch(url, requestOptions).then(handleResponse);
}

function put(url, body) {
    const requestOptions = {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader(url) },
        body: JSON.stringify(body)
    };

    return fetch(url, requestOptions).then(handleResponse);
}

function _delete(url) {
    const requestOptions = {
        method: 'DELETE',
        headers: authHeader(url)
    };

    return fetch(url, requestOptions).then(handleResponse);
}

// added multi-form data
function sendData(url, data) {
    const formData = new FormData();

    for (const [key, value] of Object.entries(data)) {
        formData.append(key, value);
    }

    const requestOptions = {
        method: 'POST', 
        headers: authHeader(url),
        body: formData
    };

    return fetch(url, requestOptions).then(handleResponse);
}

function postCors(url, body) {
    const requestOptions = {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...authHeader(url) },
        body: JSON.stringify(body)
    };
    return fetch(url, requestOptions).then(handleResponse);
}
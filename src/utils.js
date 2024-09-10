export const readLocalStorage = async (key) => {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get([key], function (result) {
            if (result[key] === undefined) {
                reject();
            } else {
                resolve(result[key]);
            }
        });
    });
};

export const writeLocalStorage = async (key, value) => {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [key]: value }, function () {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
};

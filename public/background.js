

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.commands.onCommand.addListener((command) => {
    if (command === "open_side_panel") {
        chrome.windows.getCurrent((window) => {
            chrome.sidePanel.open({
                windowId: window.id,
            }, () => { chrome.windows.update(window.id, { focused: true }) });
        });
    }
});
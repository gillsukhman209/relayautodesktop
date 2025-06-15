// ExtPay Background Integration
importScripts("ExtPay.js");
const extpay = ExtPay("relay-ai-booker");
extpay.startBackground();

const RULES = [
  {
    id: 1,
    priority: 1,
    action: {
      type: "block",
    },
    condition: {
      urlFilter: "/similar",
      resourceTypes: ["xmlhttprequest"],
    },
  },
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.getDynamicRules((rules) => {
    const ruleIdsToRemove = rules.map((rule) => rule.id);
    chrome.declarativeNetRequest.updateDynamicRules(
      {
        removeRuleIds: ruleIdsToRemove,
        addRules: RULES,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error updating declarativeNetRequest rules:",
            chrome.runtime.lastError
          );
        } else {
          console.log("ARL: Network blocking rules have been updated.");
        }
      }
    );
  });
});

const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription");

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

let pushConfigured = false;

if (vapidPublicKey && vapidPrivateKey) {

    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:admin@example.com",
        vapidPublicKey,
        vapidPrivateKey
    );

    pushConfigured = true;

} else {

    // VAPID keys generate karke .env me daalne tak push silently
    // skip ho jaayegi (server crash nahi hoga) - baaki poora app
    // normally chalta rahega.
    console.warn(
        "[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY .env me set nahi hain - " +
        "push notifications abhi disabled hain."
    );

}

async function sendToSubscriptionDocs(subs, payload) {

    if (!pushConfigured || !subs.length) return;

    const data = JSON.stringify(payload);

    await Promise.all(subs.map(async (sub) => {

        try {

            await webpush.sendNotification({
                endpoint: sub.endpoint,
                keys: sub.keys
            }, data);

        }

        catch (error) {

            // 404/410 = ye subscription ab valid nahi hai (browser ne
            // permission hata di ya cache clear ho gaya) - DB se hata do.
            if (error.statusCode === 404 || error.statusCode === 410) {
                await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
            } else {
                console.error("[push] send error:", error.message);
            }

        }

    }));

}

async function pushToAdmin(payload) {
    const subs = await PushSubscription.find({ ownerRole: "admin" }).lean();
    return sendToSubscriptionDocs(subs, payload);
}

async function pushToDeveloper(payload) {
    const subs = await PushSubscription.find({ ownerRole: "developer" }).lean();
    return sendToSubscriptionDocs(subs, payload);
}

async function pushToCustomer(customerId, payload) {
    if (!customerId) return;
    const subs = await PushSubscription.find({ ownerRole: "customer", customerId }).lean();
    return sendToSubscriptionDocs(subs, payload);
}

module.exports = {
    pushToAdmin,
    pushToDeveloper,
    pushToCustomer
};

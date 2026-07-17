import { createCookieSessionStorage } from "react-router";
import { sessionCookie } from "./cookies.server";

const {getSession,commitSession,destroySession}=createCookieSessionStorage({
    cookie:sessionCookie,

})
export {getSession,commitSession,destroySession};
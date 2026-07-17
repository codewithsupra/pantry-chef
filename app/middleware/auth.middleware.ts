import type { User } from "@prisma/client";
import { createContext, redirect, type MiddlewareFunction } from "react-router";
import { getCurrentUser } from "~/auth/auth.server";

export const userContext = createContext<User>();

export const requiredLoggedOutUserMiddleware: MiddlewareFunction = async ({ request }) => {
    const user = await getCurrentUser(request);
    if (user) {
        throw redirect('/app');
    }
}

export const requireLoggedInUserMiddleware: MiddlewareFunction = async ({ request, context }) => {
    const user = await getCurrentUser(request);
    if (!user) {
        throw redirect('/login');
    }
    context.set(userContext, user);
}
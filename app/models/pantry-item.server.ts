import { db } from "~/lib/db.server";
import { handleDeleteErrors } from "./utils";

export function createShelfItem(userId: string, shelfId: string, itemName: string) {
    return db.pantryItem.create({
        data: { userId, shelfId, name: itemName },
    });
}

export function getShelfItem(id: string) {
    return db.pantryItem.findUnique({ where: { id } });
}

export function deleteShelfItem(id: string) {
    return handleDeleteErrors(() => db.pantryItem.delete({ where: { id } }));
}

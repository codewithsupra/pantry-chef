import {db} from "~/lib/db.server"
import { handleDeleteErrors } from "./utils"

export function getALLShelves(userId: string, query: string | null) {
    return db.pantryShelf.findMany({
        where: {
            userId,
            name: {
                contains: query ?? "",
                mode: "insensitive"
            }
        },
        orderBy: { createdAt: 'desc' },
        include: {
            items: {
                orderBy: { createdAt: 'asc' }
            }
        }
    });
}

export function createShelf(userId: string) {
    return db.pantryShelf.create({
        data: { name: "Untitled", userId }
    });
}

export function deleteShelf(id: string) {
    return handleDeleteErrors(() => db.pantryShelf.delete({ where: { id } }));
}

export function saveShelfName(id: string, name: string) {
    return db.pantryShelf.update({
        where: { id },
        data: { name }
    });
}
export function getShelf(id:string){
    return db.pantryShelf.findUnique({
        where:{
            id
        }
    })
}

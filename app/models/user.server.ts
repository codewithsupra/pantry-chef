import { db } from '~/lib/db.server';

export function getUser(email: string) {
  return db.user.findUnique({ where: { email } });
}

export function createUser(email: string, firstName: string, lastName: string) {
  return db.user.create({
    data: { email, first_name: firstName, last_name: lastName },
  });
}
export function getUserById(id:string){
    return db.user.findUnique({
        where:{
            id

        }
    })
}

export function updateUser(id: string, data: { first_name: string; last_name: string }) {
  return db.user.update({ where: { id }, data });
}
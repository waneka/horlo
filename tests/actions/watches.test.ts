import { describe, it } from 'vitest'

describe('watches Server Actions auth gate — AUTH-02', () => {
  it.todo('addWatch returns { success:false, error:"Not authenticated" } when getCurrentUser throws')
  it.todo('editWatch returns { success:false, error:"Not authenticated" } when getCurrentUser throws')
  it.todo('removeWatch returns { success:false, error:"Not authenticated" } when getCurrentUser throws')
  it.todo('addWatch calls DAL.createWatch with the session user id (not a client-supplied id)')
})

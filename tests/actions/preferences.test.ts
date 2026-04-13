import { describe, it } from 'vitest'

describe('preferences Server Actions auth gate — AUTH-02', () => {
  it.todo('savePreferences returns { success:false, error:"Not authenticated" } when getCurrentUser throws')
  it.todo('savePreferences calls DAL.upsertPreferences with session user id')
})

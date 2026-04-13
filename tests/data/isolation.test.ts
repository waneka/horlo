import { describe, it } from 'vitest'

describe('IDOR isolation — AUTH-03', () => {
  it.todo('editWatch(otherUsersWatchId, data) returns { success:false, error:"Not found" }')
  it.todo('removeWatch(otherUsersWatchId) returns { success:false, error:"Not found" }')
  it.todo('User A cannot read User B preferences via savePreferences upsert path')
})

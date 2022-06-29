
--[[
  Function to move job from wait state to active.
  Input:
    keys[1] wait key
    keys[2] active key
    keys[3] stream events key
    keys[4] stalled key

    -- Rate limiting
    keys[5] rate limiter key
    keys[6] delayed key

    -- Delay events
    keys[7] delay stream key

    opts - token - lock token
    opts - lockDuration
    opts - limiter
]]

local function moveJobFromWaitToActive(keys, keyPrefix, jobId, processedOn, opts)
  -- Check if we need to perform rate limiting.
  local jobKey = keyPrefix .. jobId
  local lockKey = jobKey .. ':lock'
  
  -- get a lock
  if opts['token'] ~= "0" then
    rcall("SET", lockKey, opts['token'], "PX", opts['lockDuration'])
  end
  
  rcall("XADD", keys[3], "*", "event", "active", "jobId", jobId, "prev", "waiting")
  rcall("HSET", jobKey, "processedOn", processedOn)
  rcall("HINCRBY", jobKey, "attemptsMade", 1)
  local len = rcall("LLEN", keys[1])
  if len == 0 then
    rcall("XADD", keys[3], "*", "event", "drained");
  end

  return {rcall("HGETALL", jobKey), jobId} -- get job data
end

--[[
  Adds a job to the queue by doing the following:
    - Increases the job counter if needed.
    - Creates a new job key with the job data.

    - if delayed:
      - computes timestamp.
      - adds to delayed zset.
      - Emits a global event 'delayed' if the job is delayed.
    - if not delayed
      - Adds the jobId to the wait/paused list
      - Adds the job to the "added" list so that workers gets notified.

    Input:
      KEYS[1] 'wait',
      KEYS[2] 'paused'
      KEYS[3] 'meta'
      KEYS[4] 'id'
      KEYS[5] 'delayed'
      KEYS[6] 'completed'
      KEYS[7] events stream key
      KEYS[8] delay stream key
      
      ARGV[1] msgpacked arguments array
            [1]  key prefix,
            [2]  name
            [3]  timestamp

      ARGV[2] Json stringified job data
      ARGV[3] msgpacked options

      Output:
        jobId  - int increase from 1
]]
local jobId
local jobIdKey
local rcall = redis.call

local args = cmsgpack.unpack(ARGV[1])
local data = ARGV[2]
local opts = cmsgpack.unpack(ARGV[3])

-- @include "includes/destructureJobKey"
-- @include "includes/trimEvents"
local jobCounter = rcall("INCR",KEYS[4])

-- Trim events before emiting them to avoid trimming events emitted in this script
trimEvents(KEYS[3], KEYS[7])

jobId = jobCounter
jobIdKey = args[1] .. jobId

-- Store the job.
local jsonOpts = cjson.encode(opts)
local delay = opts['delay'] or 0
local timestamp = args[3]

rcall("HMSET", jobIdKey, "name", args[2], "data", ARGV[2], "opts", jsonOpts,
      "timestamp", timestamp, "delay", delay)
rcall("XADD", KEYS[7], "*", "event", "added", "jobId", jobId, "name", args[2], "data", ARGV[2], "opts", jsonOpts)

-- Check if job is delayed
local delayedTimestamp = (delay > 0 and (timestamp + delay)) or 0

-- Check if job is a deplayed
if (delayedTimestamp ~= 0) then
    local timestamp = delayedTimestamp * 0x1000 + bit.band(jobCounter, 0xfff)
    rcall("ZADD", KEYS[5], timestamp, jobId)
    rcall("XADD", KEYS[7], "*", "event", "delayed", "jobId", jobId, "delay",delayedTimestamp)
    rcall("XADD", KEYS[8], "*", "nextTimestamp", delayedTimestamp)
else
    local target
    -- We check for the meta.paused key to decide if we are paused or not
    -- (since an empty list and !EXISTS are not really the same)
    local paused
    if rcall("HEXISTS", KEYS[3], "paused") ~= 1 then
        target = KEYS[1]
        paused = false
    else
        target = KEYS[2]
        paused = true
    end

    -- push the jobid at the head of the list
    rcall('LPUSH', target, jobId)

    -- Emit waiting event
    rcall("XADD", KEYS[7], "*", "event", "waiting", "jobId", jobId)
end

return jobId .. "" -- convert to string

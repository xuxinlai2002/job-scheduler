--[[
  Function to remove job.
]]

local function removeJob(key, hard, baseKey)
  local jobKey = baseKey .. key
  rcall("DEL", jobKey, jobKey .. ':logs',
    jobKey .. ':dependencies', jobKey .. ':processed')
end

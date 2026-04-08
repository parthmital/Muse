# track.getSimilar

Get the similar tracks for this track on Last.fm, based on listening data.

## Endpoint Details

| Property           | Value                           |
| ------------------ | ------------------------------- |
| **Method**         | GET                             |
| **Endpoint**       | `/2.0/?method=track.getsimilar` |
| **Authentication** | Not Required                    |

## Parameters

| Parameter     | Required          | Description                                                                                                                                                         |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `track`       | Yes (unless mbid) | The track name                                                                                                                                                      |
| `artist`      | Yes (unless mbid) | The artist name                                                                                                                                                     |
| `mbid`        | No                | The musicbrainz id for the track                                                                                                                                    |
| `autocorrect` | No                | Transform misspelled artist and track names into correct artist and track names (`0` or `1`). The corrected artist and track name will be returned in the response. |
| `limit`       | No                | Maximum number of similar tracks to return                                                                                                                          |
| `api_key`     | Yes               | A Last.fm API key                                                                                                                                                   |

## Example URLs

- **JSON**: `/2.0/?method=track.getsimilar&artist=cher&track=believe&api_key=YOUR_API_KEY&format=json`
- **XML**: `/2.0/?method=track.getsimilar&artist=cher&track=believe&api_key=YOUR_API_KEY`

## Sample Response (XML)

```xml
<similartracks track="Believe" artist="Cher">
  <track>
    <name>Ray of Light</name>
    <mbid/>
    <match>10.95</match>
    <url>http://www.last.fm/music/Madonna/_/Ray+of+Light</url>
    <streamable fulltrack="0">1</streamable>
    <artist>
      <name>Madonna</name>
      <mbid>79239441-bfd5-4981-a70c-55c3f15c1287</mbid>
      <url>http://www.last.fm/music/Madonna</url>
    </artist>
    <image size="small">http://cdn.last.fm/coverart/50x50/1934.jpg</image>
    <image size="medium">http://cdn.last.fm/coverart/130x130/1934.jpg</image>
    <image size="large">http://cdn.last.fm/coverart/130x130/1934.jpg</image>
  </track>
  ...
</similartracks>
```

## Error Codes

| Code | Description                                                                            |
| ---- | -------------------------------------------------------------------------------------- |
| 2    | Invalid service - This service does not exist                                          |
| 3    | Invalid Method - No method with that name in this package                              |
| 4    | Authentication Failed - You do not have permissions to access the service              |
| 5    | Invalid format - This service doesn't exist in that format                             |
| 6    | Invalid parameters - Your request is missing a required parameter                      |
| 7    | Invalid resource specified                                                             |
| 8    | Operation failed - Something else went wrong                                           |
| 9    | Invalid session key - Please re-authenticate                                           |
| 10   | Invalid API key - You must be granted a valid key by last.fm                           |
| 11   | Service Offline - This service is temporarily offline. Try again later.                |
| 13   | Invalid method signature supplied                                                      |
| 16   | There was a temporary error processing your request. Please try again                  |
| 26   | Suspended API key - Access for your account has been suspended, please contact Last.fm |
| 29   | Rate limit exceeded - Your IP has made too many requests in a short period             |

## Related Methods

- `track.getInfo` (previous)
- `track.getTags` (next)

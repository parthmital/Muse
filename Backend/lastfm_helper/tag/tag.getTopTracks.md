# tag.getTopTracks

Get the top tracks tagged by this tag, ordered by tag count.

## Endpoint Details

| Property           | Value                           |
| ------------------ | ------------------------------- |
| **Method**         | GET                             |
| **Endpoint**       | `/2.0/?method=tag.gettoptracks` |
| **Authentication** | Not Required                    |

## Parameters

| Parameter | Required | Description                                              |
| --------- | -------- | -------------------------------------------------------- |
| `tag`     | Yes      | The tag name                                             |
| `page`    | No       | The page number to fetch. Defaults to first page.        |
| `limit`   | No       | The number of results to fetch per page. Defaults to 50. |
| `api_key` | Yes      | A Last.fm API key                                        |

## Example URLs

- **JSON**: `/2.0/?method=tag.gettoptracks&tag=disco&api_key=YOUR_API_KEY&format=json`
- **XML**: `/2.0/?method=tag.gettoptracks&tag=disco&api_key=YOUR_API_KEY`

## Sample Response (XML)

```xml
<toptracks tag="Disco">
  <track rank="">
    <name>Stayin' Alive</name>
    <mbid/>
    <url>
      http://www.last.fm/music/Bee+Gees/_/Stayin'+Alive
    </url>
    <streamable fulltrack="0">1</streamable>
    <artist>
      <name>Bee Gees</name>
      <mbid>bf0f7e29-dfe1-416c-b5c6-f9ebc19ea810</mbid>
      <url>http://www.last.fm/music/Bee+Gees</url>
    </artist>
    <image size="small">...</image>
    <image size="medium">...</image>
    <image size="large">...</image>
  </track>
  ...
</toptracks>
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

- `tag.getTopTags` (previous)
- `tag.getWeeklyChartList` (next)

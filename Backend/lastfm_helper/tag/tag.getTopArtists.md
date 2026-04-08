# tag.getTopArtists

Get the top artists tagged by this tag, ordered by tag count.

## Endpoint Details

| Property           | Value                            |
| ------------------ | -------------------------------- |
| **Method**         | GET                              |
| **Endpoint**       | `/2.0/?method=tag.gettopartists` |
| **Authentication** | Not Required                     |

## Parameters

| Parameter | Required | Description                                              |
| --------- | -------- | -------------------------------------------------------- |
| `tag`     | Yes      | The tag name                                             |
| `page`    | No       | The page number to fetch. Defaults to first page.        |
| `limit`   | No       | The number of results to fetch per page. Defaults to 50. |
| `api_key` | Yes      | A Last.fm API key                                        |

## Example URLs

- **JSON**: `/2.0/?method=tag.gettopartists&tag=disco&api_key=YOUR_API_KEY&format=json`
- **XML**: `/2.0/?method=tag.gettopartists&tag=disco&api_key=YOUR_API_KEY`

## Sample Response (XML)

```xml
<topartists tag="Disco">
  <artist rank="">
    <name>ABBA</name>
    <mbid>d87e52c5-bb8d-4da8-b941-9f4928627dc8</mbid>
    <url>http://www.last.fm/music/ABBA</url>
    <streamable>1</streamable>
    <image size="small">...</image>
    <image size="medium">...</image>
    <image size="large">...</image>
  </artist>
  ...
</topartists>
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

- `tag.getTopAlbums` (previous)
- `tag.getTopTags` (next)

export async function uploadBase64ToSpaces(base64String, key) {
    const buffer     = Buffer.from(base64String, 'base64');
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { s3Client } = await import('@/lib/spaces-client');
    await s3Client.send(new PutObjectCommand({
        Bucket:      process.env.SPACES_BUCKET,
        Key:         key,
        Body:        buffer,
        ContentType: 'image/jpeg',
        ACL:         'private',
    }));
    return key;
}
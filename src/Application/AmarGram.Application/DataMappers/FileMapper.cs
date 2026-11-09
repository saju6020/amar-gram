using AmarGram.Application.Commands.StoredFile;
using AmarGram.Domain.Models;

namespace AmarGram.Application.DataMappers;

public static class FileMapper
{
    public static StoredFileRegistrationDto ToDomainDto(this RegisterStoredFileCommand command) =>
        new(command.FileId, command.Purpose, command.ContentType, command.SizeInBytes, command.Sha256,
            command.OriginalFileName, command.StorageKey, command.UploadedBy, command.UploadedOn,
            command.ScannerName, command.RetainUntil, command.UserContext, command.CorrelationId);
}

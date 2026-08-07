cat firestore.rules | sed '/match \/users\/{userId}/i \
    match /gamificationProfiles/{userId} {\
      allow read: if isOwner(userId) || isAdmin() || userId.startsWith("anon_");\
      allow create: if isOwner(userId) || userId.startsWith("anon_");\
      allow update: if (isOwner(userId) || userId.startsWith("anon_")) &&\
        request.resource.data.userId == resource.data.userId &&\
        (request.resource.data.totalPoints >= resource.data.totalPoints);\
    }\
' > firestore.rules.new
mv firestore.rules.new firestore.rules

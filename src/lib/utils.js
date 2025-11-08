import { v4 as uuidv4 } from 'uuid';

export const FileExists = (url) => {
    if (!url) {
        return;    
    }

    let exist = true;
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.send();
    request.onload = function() {
        if (request.status !== 200) {
            console.log("image doesn't exist");
            exist = false;
        }
    }

    return exist;
}


export const UppercaseFirstLetter = (str) => {
    if (!str) {
        return;
    }
    const arr = str.split(" ");

    for (var i = 0; i < arr.length; i++) {
        arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1);
    
    }

    return arr ? arr.join(" ") : '';
}

export const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const checkFileSize = (size) => {
    let msg;

    const fileSize = Math.round((size / 1024));
    
    if (fileSize > 1028) {
        msg = 'File too big, please select a file less than 1mb';
    }

    return msg;
}

export const formatPricePhp = (num) => {
    if (num) {
        if (num < 0) {
            const absNum = Math.abs(num);
            const price = new Intl.NumberFormat('fil-PH', { style: 'currency', currency: 'PHP' }).format(absNum);
            return `(${price.replace('.00', '')})`;
        } else {
            const price = new Intl.NumberFormat('fil-PH', { style: 'currency', currency: 'PHP' }).format(num);
            return price.replace('.00', '');
        }
    } else {
        return '0';
    }
}

 export const isBlank = (str) => {
    return (!str || /^\s*$/.test(str));
}

export const containsOnlyNumbers = (str) => {
    return /^\d+$/.test(str);
}

export const getTotal = (arr, prop) => {
    return arr.reduce((a, b) => {
        return a + b[prop];
    }, 0);
}

export const containsAnyLetters = (str) => {
    return /[a-zA-Z]/.test(str);
}

export const roman_to_Int = (str1) => {
    if(str1 == null) return -1;
    var num = char_to_int(str1.charAt(0));
    var pre, curr;
    
    for(var i = 1; i < str1.length; i++) {
        curr = char_to_int(str1.charAt(i));
        pre = char_to_int(str1.charAt(i-1));
        if(curr <= pre) {
            num += curr;
        } else {
            num = num - pre*2 + curr;
        }
    }
    
    return num;
}
    
const char_to_int = (c) => {
    switch (c) {
        case 'I': return 1;
        case 'V': return 5;
        case 'X': return 10;
        case 'L': return 50;
        case 'C': return 100;
        case 'D': return 500;
        case 'M': return 1000;
        default: return -1;
    }
}

export const extractName = (name) => {
    const _name = name && name !== undefined ? name.trim() : null;
    if (_name) {
        let firstName;
        let middleName;
        let lastName;
        const arg = _name.split(' ');
        if (arg.length == 2) {
            firstName = arg[0];
            lastName = arg[1];
        } else if (arg.length === 3) {
            firstName = arg[0]; 
            middleName = arg[1]; 
            lastName = arg[2];
        } else if (arg.length === 4) {
            firstName = arg[0] + ' ' + arg[1];
            middleName = arg[2];
            lastName = arg[3];
        } else if (arg.length === 5) {
            firstName = arg[0] + ' ' + arg[1] + ' ' + arg[1];
            middleName = arg[3]; 
            lastName = arg[4];
        }

        return { firstName, middleName, lastName };
    } else {
        return null;
    }
}

export const jsonTryParse = (str, defVal) => {
    try {
        return JSON.parse(str)
    } catch(e) {
        return defVal ?? str;
    }
}

export const generateUUID = () => uuidv4();


export const safeNumber = (value) => {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
};

export const hasValidGroupLeader = (arr) => {
  // 1. Find all individuals designated as group leaders.
  const designatedGroupLeaders = arr.filter(person => person.groupLeader === true);

  // 2. If no one is even designated as a group leader, then there's no valid group leader.
  if (designatedGroupLeaders.length === 0) {
    return false;
  }

  // 3. Check if *any* of these designated group leaders are *not* disqualified.
  // A designated group leader is "disqualified" if their own loanCycle is 1 AND their own status is 'pending'.
  const hasAtLeastOneValidLeader = designatedGroupLeaders.some(leader => {
    // A leader is valid if they DO NOT meet the disqualifying criteria
    return !(leader.loanCycle === 1 && leader.status === 'pending');
  });

  // If at least one designated group leader is found who is not disqualified, return true.
  return hasAtLeastOneValidLeader;
};

// lib/navigationUtils.js

export const shouldIncludeViewMode = (currentUser) => {
  if (!currentUser?.role) return false;
  
  // Exclude viewMode for role.rep 3 or 4, or area_admin
  if (currentUser.role.rep === 3 || currentUser.role.rep === 4) {
    return false;
  }
  
  if (currentUser.role.shortCode === 'area_admin') {
    return false;
  }
  
  return true;
};

export const getDefaultViewMode = (currentUser, defaultMode = 'branch') => {
    if (!currentUser?.role) return defaultMode;
    // For role.rep 3 
    if (currentUser.role.rep === 3 ) {
        return 'lo';
    } else if (currentUser.role.rep === 4) {
        return 'group';
    }

    return defaultMode;
}

export const buildModernBranchCashCollectionsSourceQuery = (router, viewMode, currentFilter, selectedBranchGroup, dateFilter) => {
  return {
    fromModernBranchCashCollections: 'true',
    sourceViewMode: viewMode,
    sourceFilter: currentFilter,
    sourceId: router.query.id,
    sourceParentId: router.query.parentId,
    sourceGrandParentId: router.query.grandParentId,
    sourceBranchGroup: selectedBranchGroup,
    sourceDateFilter: dateFilter
  };
};

export const handleBackToModernBranchCashCollections = (router, currentUser) => {
  // Check if we came from ModernBranchCashCollections
  if (router.query.fromModernBranchCashCollections !== 'true') {
    return false; // Not from ModernBranchCashCollections
  }
  
  // Build the query to navigate back to ModernBranchCashCollections
  const backQuery = {};
  
  // Add viewMode if it was provided and user role allows it
  if (router.query.sourceViewMode && shouldIncludeViewMode(currentUser)) {
    backQuery.viewMode = router.query.sourceViewMode;
  }
  
  // Add hierarchical navigation parameters
  if (router.query.sourceId) {
    backQuery.id = router.query.sourceId;
  }
  
  if (router.query.sourceFilter) {
    backQuery.filter = router.query.sourceFilter;
  }
  
  if (router.query.sourceParentId) {
    backQuery.parentId = router.query.sourceParentId;
  }
  
  if (router.query.sourceGrandParentId) {
    backQuery.grandParentId = router.query.sourceGrandParentId;
  }
  
  // Navigate back to ModernBranchCashCollections with the preserved state
  router.push({
    pathname: '/transactions/branch-manager/v2',
    query: backQuery
  });
  
  // If there was a date filter, restore it in localStorage
  if (router.query.sourceDateFilter) {
    localStorage.setItem('cashCollectionDateFilter', router.query.sourceDateFilter);
  }
  
  return true; // Successfully handled back navigation
};
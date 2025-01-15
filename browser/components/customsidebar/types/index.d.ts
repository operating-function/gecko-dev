declare namespace CustomSidebar {
  interface TabState {
    url: string;
    hasArchive: boolean;
    peerDataLoading: boolean;
    peerData?: PeerData[];
  }

  interface PeerData {
    peerId: string;
    contentHash: string;
    archiveDate: Date;
  }

  interface ArchiveResult {
    url: string;
    contentHash: string;
    archiveDate: Date;
    archiveData: Uint8Array;
  }
}

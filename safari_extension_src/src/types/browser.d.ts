// Safari Web Extension API type declarations
declare namespace browser {
  namespace runtime {
    function sendMessage(message: any): Promise<any>;
    function sendNativeMessage(applicationId: string, message: any): Promise<any>;
    const onMessage: {
      addListener(callback: (message: any, sender: any) => Promise<any> | void): void;
    };
    function getURL(path: string): string;
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      title?: string;
      active?: boolean;
    }

    function query(queryInfo: { active?: boolean; currentWindow?: boolean }): Promise<Tab[]>;
    function create(createProperties: { url?: string; active?: boolean }): Promise<Tab>;
    function remove(tabId: number): Promise<void>;
    function update(tabId: number, updateProperties: { url?: string }): Promise<Tab>;
    function goBack(tabId: number): Promise<void>;
    function goForward(tabId: number): Promise<void>;
  }

  namespace storage {
    namespace local {
      function get(keys: string | string[]): Promise<Record<string, any>>;
      function set(items: Record<string, any>): Promise<void>;
      function remove(keys: string | string[]): Promise<void>;
    }
  }
}
